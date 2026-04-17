package com.vibraphone.color.api;

import com.vibraphone.color.domain.ColorService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.HttpStatus.CREATED;

@RestController
@Validated
@RequestMapping("/api/colors")
public class ColorController {

    private final ColorService colorService;

    public ColorController(ColorService colorService) {
        this.colorService = colorService;
    }

    @PostMapping("/submissions")
    @ResponseStatus(CREATED)
    public ColorSubmissionResponse submit(@Valid @RequestBody ColorSubmissionRequest request) {
        return colorService.submit(request);
    }

    @GetMapping("/submissions")
    public List<ColorSubmissionResponse> recentSubmissions(
            @RequestParam(defaultValue = "24")
            @Min(1)
            @Max(200)
            int limit) {
        return colorService.getRecentSubmissions(limit);
    }

    @GetMapping("/collage")
    public CollageResponse collage(
            @RequestParam(defaultValue = "6")
            @Min(2)
            @Max(24)
            int width,
            @RequestParam(defaultValue = "8")
            @Min(2)
            @Max(24)
            int height,
            @RequestParam(defaultValue = "48")
            @Min(1)
            @Max(720)
            int hours) {
        return colorService.generateCollage(width, height, hours);
    }
}
