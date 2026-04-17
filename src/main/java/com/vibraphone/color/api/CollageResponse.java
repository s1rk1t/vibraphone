package com.vibraphone.color.api;

import java.time.Instant;
import java.util.List;

public record CollageResponse(
        Instant generatedAt,
        int width,
        int height,
        int totalSubmissions,
        long activeContributors,
        List<DominantColorResponse> dominantColors,
        List<CollageCellResponse> cells
) {
}
