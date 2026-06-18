package videoInterview.Interview.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.*;
import videoInterview.Interview.dto.room.RoomResponse;
import videoInterview.Interview.dto.room.RoomSyncRequest;
import videoInterview.Interview.service.RoomService;



@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    // ─── Create Room (INTERVIEWER only) ───────────────────────────────────────
    @PostMapping("/create/{interviewId}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<RoomResponse> createRoom(
            @PathVariable String interviewId
    ) {
        RoomResponse response = roomService.createRoom(interviewId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ─── Get Room by ID ───────────────────────────────────────────────────────
    @GetMapping("/{roomId}")
    public ResponseEntity<RoomResponse> getRoom(
            @PathVariable String roomId
    ) {
        RoomResponse response = roomService.getRoom(roomId);
        return ResponseEntity.ok(response);
    }

    // ─── Get Room by Interview ID ─────────────────────────────────────────────
    @GetMapping("/interview/{interviewId}")
    public ResponseEntity<RoomResponse> getRoomByInterview(
            @PathVariable String interviewId
    ) {
        RoomResponse response = roomService.getRoomByInterview(interviewId);
        return ResponseEntity.ok(response);
    }

    // ─── Participant Joined — called by Node.js relay ─────────────────────────
    @PostMapping("/{roomId}/joined")
    public ResponseEntity<RoomResponse> participantJoined(
            @PathVariable String roomId
    ) {
        RoomResponse response = roomService.participantJoined(roomId);
        return ResponseEntity.ok(response);
    }

    // ─── Participant Left — called by Node.js relay ───────────────────────────
    @PostMapping("/{roomId}/left")
    public ResponseEntity<RoomResponse> participantLeft(
            @PathVariable String roomId
    ) {
        RoomResponse response = roomService.participantLeft(roomId);
        return ResponseEntity.ok(response);
    }

    // ─── Sync Room State — called by Node.js relay every 10 seconds ──────────
    @PostMapping("/{roomId}/sync")
    public ResponseEntity<RoomResponse> syncRoom(
            @PathVariable String roomId,
            @RequestBody RoomSyncRequest request
    ) {
        RoomResponse response = roomService.syncRoom(roomId, request);
        return ResponseEntity.ok(response);
    }

    // ─── Load Question into Room (INTERVIEWER only) ───────────────────────────
    @PostMapping("/{roomId}/question/{questionId}")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<RoomResponse> loadQuestion(
            @PathVariable String roomId,
            @PathVariable String questionId
    ) {
        RoomResponse response = roomService.loadQuestion(roomId, questionId);
        return ResponseEntity.ok(response);
    }

    // ─── Close Room (INTERVIEWER only) ────────────────────────────────────────
    @PostMapping("/{roomId}/close")
    @PreAuthorize("hasRole('INTERVIEWER')")
    public ResponseEntity<RoomResponse> closeRoom(
            @PathVariable String roomId
    ) {
        RoomResponse response = roomService.closeRoom(roomId);
        return ResponseEntity.ok(response);
    }
}