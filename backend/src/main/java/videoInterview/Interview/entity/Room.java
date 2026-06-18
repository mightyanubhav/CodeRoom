package videoInterview.Interview.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // Linked to interview — one room per interview
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_id", nullable = false)
    private Interview interview;

    // Currently loaded question in the editor
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private Question question;

    // Current code in the editor — persisted every 10 seconds
    @Column(name = "current_code", columnDefinition = "TEXT")
    private String currentCode;

    // Language selected in Monaco editor
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    // Room status
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    // How many participants are currently in the room
    @Column(name = "participant_count")
    @Builder.Default
    private Integer participantCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Language {
        JAVA,
        PYTHON,
        JAVASCRIPT,
        GO,
        CPP
    }

    public enum Status {
        WAITING,      // room created, no one joined yet
        ACTIVE,       // both participants in room
        LOCKED,       // max participants reached
        CLOSED        // interview ended
    }
}