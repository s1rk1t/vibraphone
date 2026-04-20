package com.vibraphone.color.domain;

import com.vibraphone.color.api.CollageResponse;
import com.vibraphone.color.api.ColorSubmissionRequest;
import com.vibraphone.color.api.ColorSubmissionResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ColorServiceTest {

    private final ColorSubmissionRepository repository = mock(ColorSubmissionRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-04-17T12:00:00Z"), ZoneOffset.UTC);
    private final ColorService service = new ColorService(repository, clock);

    @Test
    void submitNormalizesHexColor() {
        when(repository.save(any(ColorSubmission.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ColorSubmissionResponse saved = service.submit(new ColorSubmissionRequest("e47a92", "device-1", 0.42, 0.33));

        assertThat(saved.hexColor()).isEqualTo("#E47A92");
        assertThat(saved.deviceId()).isEqualTo("device-1");
        assertThat(saved.createdAt()).isEqualTo(Instant.parse("2026-04-17T12:00:00Z"));
    }

    @Test
    void recentSubmissionsRespectSinceOverride() {
        Instant sessionStart = Instant.parse("2026-04-17T11:50:00Z");
        List<ColorSubmission> submissions = List.of(
                new ColorSubmission("#EE7755", "device-a", 0.1, 0.4, sessionStart)
        );

        when(repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(eq(sessionStart), any()))
                .thenReturn(submissions);

        List<ColorSubmissionResponse> recent = service.getRecentSubmissions(8, sessionStart);

        assertThat(recent).hasSize(1);
        assertThat(recent.get(0).hexColor()).isEqualTo("#EE7755");
    }

    @Test
    void collageUsesSessionWindowAndCreatesVariedGrid() {
        Instant recent = Instant.parse("2026-04-17T11:30:00Z");
        Instant sessionStart = Instant.parse("2026-04-17T11:00:00Z");
        List<ColorSubmission> submissions = List.of(
                new ColorSubmission("#EE7755", "device-a", 0.08, 0.12, recent),
                new ColorSubmission("#2D9CDB", "device-b", 0.88, 0.18, recent.minusSeconds(300)),
                new ColorSubmission("#7B61FF", "device-c", 0.22, 0.86, recent.minusSeconds(600)),
                new ColorSubmission("#F2C94C", "device-d", 0.82, 0.8, recent.minusSeconds(900))
        );

        when(repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(eq(sessionStart))).thenReturn(submissions);
        when(repository.countDistinctDeviceIdSince(eq(sessionStart))).thenReturn(4L);

        CollageResponse collage = service.generateCollage(2, 2, 24, sessionStart);

        assertThat(collage.width()).isEqualTo(2);
        assertThat(collage.height()).isEqualTo(2);
        assertThat(collage.totalSubmissions()).isEqualTo(4);
        assertThat(collage.activeContributors()).isEqualTo(4);
        assertThat(collage.cells()).hasSize(4);
        assertThat(collage.cells()).extracting(cell -> cell.hexColor()).doesNotHaveDuplicates();
        assertThat(collage.cells()).allSatisfy(cell -> assertThat(cell.hexColor()).startsWith("#"));
        assertThat(collage.cells()).anySatisfy(cell -> assertThat(cell.sampleCount()).isGreaterThan(0));
        assertThat(collage.dominantColors()).isNotEmpty();
    }
}
