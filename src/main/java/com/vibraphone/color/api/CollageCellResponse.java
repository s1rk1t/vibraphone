package com.vibraphone.color.api;

public record CollageCellResponse(
        int index,
        int row,
        int column,
        String hexColor,
        double intensity,
        int sampleCount
) {
}
