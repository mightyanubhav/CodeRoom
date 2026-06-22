package videoInterview.Interview.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import videoInterview.Interview.dto.interview.CreateInterviewRequest;
import videoInterview.Interview.dto.interview.InterviewResponse;
import videoInterview.Interview.dto.interview.ScoreRequest;
import videoInterview.Interview.service.InterviewService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;

    // ─── Create Interview (INTERVIEWER only) ──────────────────────────────────
    @PostMapping("/create")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<InterviewResponse> create(
            @AuthenticationPrincipal String interviewerId,
            @Valid @RequestBody CreateInterviewRequest request) {
        InterviewResponse response = interviewService.createInterview(interviewerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ─── Join Interview (CANDIDATE only) ──────────────────────────────────────
    @PostMapping("/join/{roomId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<InterviewResponse> join(
            @AuthenticationPrincipal String candidateId,
            @PathVariable String roomId) {
        InterviewResponse response = interviewService.joinInterview(roomId, candidateId);
        return ResponseEntity.ok(response);
    }

    // ─── End Interview (INTERVIEWER only) ─────────────────────────────────────
    @PostMapping("/end/{roomId}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<InterviewResponse> end(
            @AuthenticationPrincipal String interviewerId,
            @PathVariable String roomId) {
        InterviewResponse response = interviewService.endInterview(roomId, interviewerId);
        return ResponseEntity.ok(response);
    }

    // ─── Submit Score (INTERVIEWER only) ──────────────────────────────────────
    @PostMapping("/score/{roomId}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<InterviewResponse> score(
            @AuthenticationPrincipal String interviewerId,
            @PathVariable String roomId,
            @Valid @RequestBody ScoreRequest request) {
        InterviewResponse response = interviewService.submitScore(
                roomId,
                interviewerId,
                request.getScore(),
                request.getNotes());
        return ResponseEntity.ok(response);
    }

    // ─── Get My Interviews (INTERVIEWER only) ─────────────────────────────────
    @GetMapping("/my")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<List<InterviewResponse>> getMyInterviews(
            @AuthenticationPrincipal String interviewerId) {
        List<InterviewResponse> response = interviewService.getMyInterviews(interviewerId);
        return ResponseEntity.ok(response);
    }

    // ─── Get Interview by Room (any authenticated user) ───────────────────────
    @GetMapping("/room/{roomId}")
    public ResponseEntity<InterviewResponse> getByRoom(@PathVariable String roomId) {
        InterviewResponse response = interviewService.getByRoomId(roomId);
        return ResponseEntity.ok(response);
    }

    // GET /api/interviews/by-room-entity/{roomEntityId}
    @GetMapping("/by-room-entity/{roomEntityId}")
    public ResponseEntity<InterviewResponse> getByRoomEntityId(
            @PathVariable String roomEntityId) {
        InterviewResponse response = interviewService.getByRoomEntityId(roomEntityId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{interviewId}/room-id")
    public ResponseEntity<InterviewResponse> updateRoomId(
            @PathVariable String interviewId,
            @RequestBody Map<String, String> body) {
        InterviewResponse response = interviewService.updateRoomId(interviewId, body.get("roomId"));
        return ResponseEntity.ok(response);
    }
}