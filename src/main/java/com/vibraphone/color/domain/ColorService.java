package com.vibraphone.color.domain;

import com.vibraphone.color.api.CollageCellResponse;
import com.vibraphone.color.api.CollageResponse;
import com.vibraphone.color.api.ColorSubmissionRequest;
import com.vibraphone.color.api.ColorSubmissionResponse;
import com.vibraphone.color.api.DominantColorResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ColorService {

    private static final double MAX_COLOR_DISTANCE = 441.6729559300637;

    private final ColorSubmissionRepository repository;
    private final Clock clock;

    public ColorService(ColorSubmissionRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public ColorSubmissionResponse submit(ColorSubmissionRequest request) {
        Instant now = Instant.now(clock);
        ColorSubmission submission = new ColorSubmission(
                ColorMath.normalizeHex(request.hexColor()),
                request.deviceId().trim(),
                request.x(),
                request.y(),
                now
        );
        return ColorSubmissionResponse.from(repository.save(submission));
    }

    @Transactional(readOnly = true)
    public List<ColorSubmissionResponse> getRecentSubmissions(int limit, Instant sinceOverride) {
        List<ColorSubmission> submissions = sinceOverride == null
                ? repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))
                : repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(sinceOverride, PageRequest.of(0, limit));

        return submissions.stream()
                .map(ColorSubmissionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CollageResponse generateCollage(int width, int height, int hours, Instant sinceOverride) {
        Instant now = Instant.now(clock);
        Instant since = resolveSince(Duration.ofHours(hours), sinceOverride, now);
        List<ColorSubmission> submissions = repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(since);
        int totalCells = width * height;
        ColorMath.Rgb globalAverage = buildGlobalAverage(submissions);
        List<CellBlend> cellBlends = new ArrayList<>(totalCells);

        for (int index = 0; index < totalCells; index++) {
            int row = index / width;
            int column = index % width;
            double xRatio = width == 1 ? 0.5 : (double) column / (width - 1);
            double yRatio = height == 1 ? 0.5 : (double) row / (height - 1);
            cellBlends.add(buildCellBlend(submissions, globalAverage, xRatio, yRatio, now));
        }

        double maxInfluence = Math.max(1.0, cellBlends.stream()
                .mapToDouble(CellBlend::influenceWeight)
                .max()
                .orElse(0));
        List<CollageCellResponse> cells = new ArrayList<>(totalCells);

        for (int index = 0; index < totalCells; index++) {
            int row = index / width;
            int column = index % width;
            CellBlend cellBlend = cellBlends.get(index);
            double density = cellBlend.sampleCount() == 0
                    ? 0.16
                    : Math.min(1.0, 0.28 + ((cellBlend.influenceWeight() / maxInfluence) * 0.72));

            cells.add(new CollageCellResponse(
                    index,
                    row,
                    column,
                    ColorMath.toHex(cellBlend.color()),
                    density,
                    cellBlend.sampleCount()
            ));
        }

        return new CollageResponse(
                now,
                width,
                height,
                submissions.size(),
                repository.countDistinctDeviceIdSince(since),
                buildDominantColors(submissions),
                cells
        );
    }

    private ColorMath.Rgb buildGlobalAverage(List<ColorSubmission> submissions) {
        if (submissions.isEmpty()) {
            return new ColorMath.Rgb(175, 97, 117);
        }

        List<ColorMath.WeightedColor> colors = submissions.stream()
                .map(submission -> new ColorMath.WeightedColor(ColorMath.fromHex(submission.getHexColor()), 1.0))
                .toList();

        return ColorMath.average(colors);
    }

    private CellBlend buildCellBlend(
            List<ColorSubmission> submissions,
            ColorMath.Rgb globalAverage,
            double xRatio,
            double yRatio,
            Instant now
    ) {
        List<ColorMath.WeightedColor> weightedColors = new ArrayList<>(submissions.size() + 1);
        double influenceWeight = 0;
        int contributingSamples = 0;

        for (ColorSubmission submission : submissions) {
            double ageHours = Math.max(0, Duration.between(submission.getCreatedAt(), now).toMinutes() / 60.0);
            double freshness = 1.0 / (1.0 + (ageHours * 0.7));
            double dx = xRatio - submission.getX();
            double dy = yRatio - submission.getY();
            double distance = Math.sqrt((dx * dx) + (dy * dy));
            double proximity = Math.max(0, 1.15 - (distance * 1.7));

            if (proximity <= 0) {
                continue;
            }

            double paletteBias = 0.96 + (submission.getX() * 0.18) + ((1 - submission.getY()) * 0.14);
            double weight = freshness * Math.pow(proximity, 2.2) * paletteBias;
            weightedColors.add(new ColorMath.WeightedColor(ColorMath.fromHex(submission.getHexColor()), weight));
            influenceWeight += weight;

            if (proximity >= 0.42) {
                contributingSamples += 1;
            }
        }

        ColorMath.Rgb accent = ColorMath.accentForCell(xRatio, yRatio);
        double accentWeight = submissions.isEmpty() ? 0.72 : 0.18;
        weightedColors.add(new ColorMath.WeightedColor(accent, accentWeight));

        ColorMath.Rgb average = ColorMath.average(weightedColors);
        double contrast = ColorMath.distance(average, globalAverage) / MAX_COLOR_DISTANCE;
        double accentBlend = submissions.isEmpty()
                ? 0.38
                : Math.max(0.08, 0.18 - Math.min(0.1, influenceWeight * 0.06));
        ColorMath.Rgb balanced = ColorMath.blend(average, accent, accentBlend);
        ColorMath.Rgb saturated = ColorMath.saturate(balanced, 0.16 + (contrast * 0.32));

        return new CellBlend(saturated, influenceWeight, contributingSamples);
    }

    private List<DominantColorResponse> buildDominantColors(List<ColorSubmission> submissions) {
        if (submissions.isEmpty()) {
            return List.of();
        }

        Map<String, Long> groupedColors = new LinkedHashMap<>();

        for (ColorSubmission submission : submissions) {
            String quantized = ColorMath.quantizeHex(submission.getHexColor());
            groupedColors.merge(quantized, 1L, Long::sum);
        }

        long total = submissions.size();

        return groupedColors.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(entry -> new DominantColorResponse(
                        entry.getKey(),
                        entry.getValue(),
                        entry.getValue() / (double) total
                ))
                .toList();
    }

    private Instant resolveSince(Duration fallbackWindow, Instant sinceOverride, Instant now) {
        Instant fallbackSince = now.minus(fallbackWindow);

        if (sinceOverride == null || sinceOverride.isBefore(fallbackSince)) {
            return fallbackSince;
        }

        return sinceOverride;
    }

    private record CellBlend(ColorMath.Rgb color, double influenceWeight, int sampleCount) {
    }
}
