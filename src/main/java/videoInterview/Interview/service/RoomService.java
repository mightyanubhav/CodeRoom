package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import videoInterview.Interview.dto.room.RoomResponse;
import videoInterview.Interview.dto.room.RoomSyncRequest;
import videoInterview.Interview.entity.Interview;
import videoInterview.Interview.entity.Question;
import videoInterview.Interview.entity.Room;
import videoInterview.Interview.repository.InterviewRepository;
import videoInterview.Interview.repository.QuestionRepository;
import videoInterview.Interview.repository.RoomRepository;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final InterviewRepository interviewRepository;
    private final QuestionRepository questionRepository;

    // ─── Create Room when Interview is created ────────────────────────────────

    @Transactional
    public RoomResponse createRoom(String interviewId) {

        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));

        // Check room doesn't already exist
        roomRepository.findByInterviewId(interviewId).ifPresent(r -> {
            throw new RuntimeException("Room already exists for this interview");
        });

        Room room = Room.builder()
                .interview(interview)
                .language(Room.Language.JAVASCRIPT)  // default language
                .status(Room.Status.WAITING)
                .build();

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Get Room by ID ───────────────────────────────────────────────────────

    public RoomResponse getRoom(String roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        return toResponse(room);
    }

    // ─── Get Room by Interview ID ─────────────────────────────────────────────

    public RoomResponse getRoomByInterview(String interviewId) {
        Room room = roomRepository.findByInterviewId(interviewId)
                .orElseThrow(() -> new RuntimeException("Room not found for this interview"));
        return toResponse(room);
    }

    // ─── Participant joins room ───────────────────────────────────────────────

    @Transactional
    public RoomResponse participantJoined(String roomId) {

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        // Max 2 participants — interviewer + candidate
        if (room.getParticipantCount() >= 2) {
            throw new RuntimeException("Room is full");
        }

        room.setParticipantCount(room.getParticipantCount() + 1);

        // Both joined — lock the room
        if (room.getParticipantCount() == 2) {
            room.setStatus(Room.Status.LOCKED);
        } else {
            room.setStatus(Room.Status.ACTIVE);
        }

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Participant leaves room ──────────────────────────────────────────────

    @Transactional
    public RoomResponse participantLeft(String roomId) {

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        int count = Math.max(0, room.getParticipantCount() - 1);
        room.setParticipantCount(count);
        room.setStatus(Room.Status.ACTIVE);

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Sync room state from Node.js relay ──────────────────────────────────
    // Called every 10 seconds by Node.js to persist current editor state

    @Transactional
    public RoomResponse syncRoom(String roomId, RoomSyncRequest request) {

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        // Update code snapshot
        if (request.getCurrentCode() != null) {
            room.setCurrentCode(request.getCurrentCode());
        }

        // Update language if changed
        if (request.getLanguage() != null) {
            room.setLanguage(Room.Language.valueOf(request.getLanguage().toUpperCase()));
        }

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Load Question into Room ──────────────────────────────────────────────

    @Transactional
    public RoomResponse loadQuestion(String roomId, String questionId) {

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        room.setQuestion(question);

        // Reset code to starter code when new question is loaded
        room.setCurrentCode(question.getStarterCode());

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Close Room ───────────────────────────────────────────────────────────

    @Transactional
    public RoomResponse closeRoom(String roomId) {

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        room.setStatus(Room.Status.CLOSED);
        room.setParticipantCount(0);

        roomRepository.save(room);

        return toResponse(room);
    }

    // ─── Map entity to response ───────────────────────────────────────────────

    private RoomResponse toResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .interviewId(room.getInterview().getId())
                .questionId(room.getQuestion() != null ? room.getQuestion().getId() : null)
                .questionTitle(room.getQuestion() != null ? room.getQuestion().getTitle() : null)
                .starterCode(room.getQuestion() != null ? room.getQuestion().getStarterCode() : null)
                .currentCode(room.getCurrentCode())
                .language(room.getLanguage().name())
                .status(room.getStatus().name())
                .participantCount(room.getParticipantCount())
                .build();
    }
}