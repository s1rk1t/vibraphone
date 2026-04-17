package com.vibraphone.color.api;

public record DominantColorResponse(
        String hexColor,
        long count,
        double percentage
) {
}
