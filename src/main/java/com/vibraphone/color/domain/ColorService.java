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
    public List<ColorSubmissionResponse> getRecentSubmissions(int limit) {
        return repository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(ColorSubmissionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CollageResponse generateCollage(int width, int height, int hours) {
        Instant now = Instant.now(clock);
        Instant since = now.minus(Duration.ofHours(hours));
        List<ColorSubmission> submissions = repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(since);
        int totalCells = width * height;
        List<List<ColorSubmission>> buckets = new ArrayList<>(totalCells);

        for (int index = 0; index < totalCells; index++) {
            buckets.add(new ArrayList<>());
        }

        for (int index = 0; index < submissions.size(); index++) {
            int bucketIndex = Math.min(totalCells - 1, (int) ((long) index * totalCells / Math.max(1, submissions.size())));
            buckets.get(bucketIndex).add(submissions.get(index));
        }

        ColorMath.Rgb globalAverage = buildGlobalAverage(submissions);
        int maxBucketSize = buckets.stream().mapToInt(List::size).max().orElse(1);
        List<CollageCellResponse> cells = new ArrayList<>(totalCells);

        for (int index = 0; index < totalCells; index++) {
            int row = index / width;
            int column = index % width;
            double xRatio = width == 1 ? 0 : (double) column / (width - 1);
            double yRatio = height == 1 ? 0 : (double) row / (height - 1);
            List<ColorSubmission> bucket = buckets.get(index);

            ColorMath.Rgb cellColor = bucket.isEmpty()
                    ? ColorMath.blend(globalAverage, ColorMath.accentForCell(xRatio, yRatio), 0.22)
                    : buildBucketAverage(bucket, now);

            double density = bucket.isEmpty()
                    ? 0.18
                    : Math.min(1.0, 0.35 + ((double) bucket.size() / maxBucketSize) * 0.65);

            cells.add(new CollageCellResponse(
                    index,
                    row,
                    column,
                    ColorMath.toHex(cellColor),
                    density,
                    bucket.size()
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

    private ColorMath.Rgb buildBucketAverage(List<ColorSubmission> bucket, Instant now) {
        List<ColorMath.WeightedColor> weightedColors = new ArrayList<>(bucket.size());

        for (ColorSubmission submission : bucket) {
            double ageHours = Math.max(0, Duration.between(submission.getCreatedAt(), now).toMinutes() / 60.0);
            double freshness = 1.0 / (1.0 + ageHours);
            double paletteBias = 0.8 + (submission.getX() * 0.3) + ((1 - submission.getY()) * 0.2);
            weightedColors.add(new ColorMath.WeightedColor(
                    ColorMath.fromHex(submission.getHexColor()),
                    freshness * paletteBias
            ));
        }

        return ColorMath.average(weightedColors);
    }

    private List<DominantColorResponse> buildDominantColors(List<ColorSubmission> submissions) {
        if (submissions.isEmpty()) {
            return List.of(new DominantColorResponse("#AF6175", 0, 0));
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
}
