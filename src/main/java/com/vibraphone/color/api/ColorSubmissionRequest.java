package com.vibraphone.color.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ColorSubmissionRequest(
        @NotBlank
        @Pattern(regexp = "^#?[0-9a-fA-F]{6}$", message = "hexColor must be a six digit hex value")
        String hexColor,

        @NotBlank
        @Size(max = 100)
        String deviceId,

        @DecimalMin("0.0")
        @DecimalMax("1.0")
        double x,

        @DecimalMin("0.0")
        @DecimalMax("1.0")
        double y
) {
}
