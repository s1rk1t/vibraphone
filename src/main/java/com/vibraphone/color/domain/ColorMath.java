package com.vibraphone.color.domain;

import java.util.List;

public final class ColorMath {

    private ColorMath() {
    }

    public static Rgb fromHex(String value) {
        String normalized = normalizeHex(value);
        int red = Integer.parseInt(normalized.substring(1, 3), 16);
        int green = Integer.parseInt(normalized.substring(3, 5), 16);
        int blue = Integer.parseInt(normalized.substring(5, 7), 16);
        return new Rgb(red, green, blue);
    }

    public static String normalizeHex(String value) {
        String candidate = value.startsWith("#") ? value : "#" + value;
        return candidate.toUpperCase();
    }

    public static String toHex(Rgb color) {
        return "#%02X%02X%02X".formatted(color.red(), color.green(), color.blue());
    }

    public static Rgb average(List<WeightedColor> colors) {
        if (colors.isEmpty()) {
            return new Rgb(196, 126, 132);
        }

        double weightedRed = 0;
        double weightedGreen = 0;
        double weightedBlue = 0;
        double totalWeight = 0;

        for (WeightedColor color : colors) {
            weightedRed += color.color().red() * color.weight();
            weightedGreen += color.color().green() * color.weight();
            weightedBlue += color.color().blue() * color.weight();
            totalWeight += color.weight();
        }

        if (totalWeight == 0) {
            return new Rgb(196, 126, 132);
        }

        return new Rgb(
                clampChannel((int) Math.round(weightedRed / totalWeight)),
                clampChannel((int) Math.round(weightedGreen / totalWeight)),
                clampChannel((int) Math.round(weightedBlue / totalWeight))
        );
    }

    public static Rgb blend(Rgb base, Rgb accent, double accentWeight) {
        double safeWeight = Math.max(0, Math.min(1, accentWeight));
        return new Rgb(
                clampChannel((int) Math.round(base.red() * (1 - safeWeight) + accent.red() * safeWeight)),
                clampChannel((int) Math.round(base.green() * (1 - safeWeight) + accent.green() * safeWeight)),
                clampChannel((int) Math.round(base.blue() * (1 - safeWeight) + accent.blue() * safeWeight))
        );
    }

    public static Rgb accentForCell(double xRatio, double yRatio) {
        int red = clampChannel((int) Math.round(92 + (110 * (1 - yRatio))));
        int green = clampChannel((int) Math.round(38 + (160 * xRatio)));
        int blue = clampChannel((int) Math.round(76 + (130 * (1 - xRatio * yRatio))));
        return new Rgb(red, green, blue);
    }

    public static String quantizeHex(String value) {
        Rgb source = fromHex(value);
        return toHex(new Rgb(
                quantize(source.red()),
                quantize(source.green()),
                quantize(source.blue())
        ));
    }

    private static int clampChannel(int channel) {
        return Math.max(0, Math.min(255, channel));
    }

    private static int quantize(int channel) {
        int bucket = (int) Math.round(channel / 32.0) * 32;
        return clampChannel(bucket);
    }

    public record Rgb(int red, int green, int blue) {
    }

    public record WeightedColor(Rgb color, double weight) {
    }
}
