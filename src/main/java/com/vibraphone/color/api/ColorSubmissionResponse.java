package com.vibraphone.color.api;

import com.vibraphone.color.domain.ColorSubmission;
import java.time.Instant;

public record ColorSubmissionResponse(
        Long id,
        String hexColor,
        String deviceId,
        double x,
        double y,
        Instant createdAt
) {
    public static ColorSubmissionResponse from(ColorSubmission submission) {
        return new ColorSubmissionResponse(
                submission.getId(),
                submission.getHexColor(),
                submission.getDeviceId(),
                submission.getX(),
                submission.getY(),
                submission.getCreatedAt()
        );
    }
}
