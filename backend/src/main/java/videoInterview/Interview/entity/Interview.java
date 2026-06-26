package videoInterview.Interview.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "interviews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // Lead interviewer who created the session
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_id", nullable = false)
    private User interviewer;

    // Additional panelist interviewers
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "interview_panelists", joinColumns = @JoinColumn(name = "interview_id"), inverseJoinColumns = @JoinColumn(name = "user_id"))
    @Builder.Default
    private List<User> panelists = new ArrayList<>();

    // Candidate being interviewed
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id")
    private User candidate;

    // Unique room link
    @Column(name = "room_id", nullable = false, unique = true)
    private String roomId;

    // Max interviewers allowed (lead + panelists)
    @Column(name = "max_interviewers")
    @Builder.Default
    private Integer maxInterviewers = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "score")
    private Integer score;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Total allowed participants = interviewers + 1 candidate
    public int getMaxParticipants() {
        return (maxInterviewers != null ? maxInterviewers : 1) + 1;
    }

    public enum Status {
        SCHEDULED,
        IN_PROGRESS,
        COMPLETED,
        REVIEWED,
        CANCELLED
    }

    @Column(name = "recording_url")
    private String recordingUrl;
}