package com.vibraphone.color.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "color_submissions")
public class ColorSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 7)
    private String hexColor;

    @Column(nullable = false, length = 100)
    private String deviceId;

    @Column(nullable = false)
    private double x;

    @Column(nullable = false)
    private double y;

    @Column(nullable = false)
    private Instant createdAt;

    protected ColorSubmission() {
    }

    public ColorSubmission(String hexColor, String deviceId, double x, double y, Instant createdAt) {
        this.hexColor = hexColor;
        this.deviceId = deviceId;
        this.x = x;
        this.y = y;
        this.createdAt = createdAt;
    }

    @PrePersist
    void initializeTimestamp() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getHexColor() {
        return hexColor;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
