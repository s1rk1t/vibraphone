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
    void collageUsesRecentColorsAndCreatesExpectedGridSize() {
        Instant recent = Instant.parse("2026-04-17T11:30:00Z");
        List<ColorSubmission> submissions = List.of(
                new ColorSubmission("#EE7755", "device-a", 0.1, 0.4, recent),
                new ColorSubmission("#BB5588", "device-b", 0.7, 0.5, recent.minusSeconds(300)),
                new ColorSubmission("#5577AA", "device-c", 0.3, 0.9, recent.minusSeconds(600))
        );

        when(repository.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(any(Instant.class))).thenReturn(submissions);
        when(repository.countDistinctDeviceIdSince(any(Instant.class))).thenReturn(3L);

        CollageResponse collage = service.generateCollage(2, 2, 24);

        assertThat(collage.width()).isEqualTo(2);
        assertThat(collage.height()).isEqualTo(2);
        assertThat(collage.totalSubmissions()).isEqualTo(3);
        assertThat(collage.activeContributors()).isEqualTo(3);
        assertThat(collage.cells()).hasSize(4);
        assertThat(collage.cells().get(0).hexColor()).startsWith("#");
        assertThat(collage.dominantColors()).isNotEmpty();
    }
}
