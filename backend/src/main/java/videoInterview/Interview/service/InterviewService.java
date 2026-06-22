package videoInterview.Interview.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import videoInterview.Interview.dto.interview.CreateInterviewRequest;
import videoInterview.Interview.dto.interview.InterviewResponse;
import videoInterview.Interview.entity.Interview;
import videoInterview.Interview.entity.Room;
import videoInterview.Interview.entity.User;
import videoInterview.Interview.repository.InterviewRepository;
import videoInterview.Interview.repository.RoomRepository;
import videoInterview.Interview.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewRepository interviewRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;

    // ─── Create Interview (Interviewer only) ──────────────────────────────────
    @Transactional
    public InterviewResponse createInterview(String interviewerId, CreateInterviewRequest request) {

        User interviewer = userRepository.findById(interviewerId)
                .orElseThrow(() -> new RuntimeException("Interviewer not found"));

        // Create interview with placeholder roomId first
        Interview interview = Interview.builder()
                .interviewer(interviewer)
                .roomId("pending")
                .status(Interview.Status.SCHEDULED)
                .scheduledAt(request.getScheduledAt())
                .build();

        interviewRepository.save(interview);

        return toResponse(interview);
    }
    // ─── Candidate joins via room link ────────────────────────────────────────

    @Transactional
    public InterviewResponse joinInterview(String roomId, String candidateId) {

        // 1. Find interview by room link
        Interview interview = interviewRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        // 2. Only SCHEDULED interviews can be joined
        if (interview.getStatus() != Interview.Status.SCHEDULED) {
            throw new RuntimeException("Interview is not available to join");
        }

        // 3. Load candidate and assign
        User candidate = userRepository.findById(candidateId)
                .orElseThrow(() -> new RuntimeException("Candidate not found"));

        interview.setCandidate(candidate);
        interview.setStatus(Interview.Status.IN_PROGRESS);
        interview.setStartedAt(LocalDateTime.now());

        interviewRepository.save(interview);

        return toResponse(interview);
    }

    // ─── End Interview ────────────────────────────────────────────────────────

    @Transactional
    public InterviewResponse endInterview(String roomId, String interviewerId) {

        Interview interview = interviewRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        // Only the interviewer can end the session
        if (!interview.getInterviewer().getId().equals(interviewerId)) {
            throw new RuntimeException("Only the interviewer can end this session");
        }

        if (interview.getStatus() != Interview.Status.IN_PROGRESS) {
            throw new RuntimeException("Interview is not in progress");
        }

        interview.setStatus(Interview.Status.COMPLETED);
        interview.setEndedAt(LocalDateTime.now());

        interviewRepository.save(interview);

        return toResponse(interview);
    }

    // ─── Submit Scorecard ─────────────────────────────────────────────────────

    @Transactional
    public InterviewResponse submitScore(String roomId, String interviewerId, Integer score, String notes) {

        Interview interview = interviewRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!interview.getInterviewer().getId().equals(interviewerId)) {
            throw new RuntimeException("Only the interviewer can submit a score");
        }

        if (interview.getStatus() != Interview.Status.COMPLETED) {
            throw new RuntimeException("Interview must be completed before scoring");
        }

        interview.setScore(score);
        interview.setNotes(notes);
        interview.setStatus(Interview.Status.REVIEWED);

        interviewRepository.save(interview);

        return toResponse(interview);
    }

    // ─── Get all interviews for interviewer ───────────────────────────────────

    public List<InterviewResponse> getMyInterviews(String interviewerId) {
        User interviewer = userRepository.findById(interviewerId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return interviewRepository
                .findByInterviewerOrderByScheduledAtDesc(interviewer)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ─── Get single interview by room ─────────────────────────────────────────

    public InterviewResponse getByRoomId(String roomId) {
        Interview interview = interviewRepository.findByRoomId(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        return toResponse(interview);
    }

    // ─── Map entity to response DTO ───────────────────────────────────────────

    private InterviewResponse toResponse(Interview interview) {
        return InterviewResponse.builder()
                .id(interview.getId())
                .roomId(interview.getRoomId())
                .status(interview.getStatus().name())
                .scheduledAt(interview.getScheduledAt())
                .startedAt(interview.getStartedAt())
                .endedAt(interview.getEndedAt())
                .score(interview.getScore())
                .notes(interview.getNotes())
                .interviewerName(interview.getInterviewer().getName())
                .candidateName(interview.getCandidate() != null ? interview.getCandidate().getName() : null)
                .build();
    }

    public InterviewResponse getByRoomEntityId(String roomEntityId) {
        Room room = roomRepository.findById(roomEntityId)
                .orElseThrow(() -> new RuntimeException("Room not found"));
        return toResponse(room.getInterview());
    }

    @Transactional
    public InterviewResponse updateRoomId(String interviewId, String roomId) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new RuntimeException("Interview not found"));
        interview.setRoomId(roomId);
        interviewRepository.save(interview);
        return toResponse(interview);
    }
}