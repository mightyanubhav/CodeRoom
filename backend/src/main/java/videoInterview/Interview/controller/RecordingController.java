package videoInterview.Interview.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import videoInterview.Interview.service.RecordingService;

import java.util.Map;

@RestController
@RequestMapping("/api/recordings")
@RequiredArgsConstructor
public class RecordingController {

    private final RecordingService recordingService;

    @PostMapping("/upload/{interviewId}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<Map<String, String>> upload(
            @PathVariable String interviewId,
            @RequestParam("file") MultipartFile file
    ) {
        try {
            String url = recordingService.uploadRecording(interviewId, file);
            return ResponseEntity.ok(Map.of(
                    "url", url,
                    "message", "Recording uploaded successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}