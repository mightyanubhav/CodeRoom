package videoInterview.Interview.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import videoInterview.Interview.security.JwtAuthFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.http.HttpMethod;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthFilter jwtAuthFilter;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                // Disable CSRF — we use JWT, not sessions/cookies
                                .csrf(AbstractHttpConfigurer::disable)
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                                // Stateless — Spring will never create an HTTP session
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                                // Route rules
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                "/api/auth/register",
                                                                "/api/auth/login",
                                                                "/api/auth/refresh",
                                                                "/api/rooms/*/joined",
                                                                "/api/rooms/*/left",
                                                                "/api/rooms/*/sync",
                                                                "/api/rooms/*/reset",
                                                                "/api/interviews/by-room-entity/*",
                                                                "/api/interviews/*/room-id",
                                                                "/api/execute",
                                                                "/swagger-ui.html",
                                                                "/swagger-ui/**",
                                                                "/api-docs/**")
                                                .permitAll()

                                                // Admin only
                                                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                                                // Interviewers only — write operations
                                                .requestMatchers(
                                                                HttpMethod.POST, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                HttpMethod.PUT, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                HttpMethod.DELETE, "/api/questions/**")
                                                .hasRole("INTERVIEWER")
                                                .requestMatchers(
                                                                "/api/interviews/create")
                                                .hasRole("INTERVIEWER")

                                                // Everything else needs a valid token
                                                .anyRequest().authenticated())

                                // Plug in our JWT filter before Spring's default login filter
                                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationManager authenticationManager(
                        AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();

                // React dev server + production Vercel URL
                config.setAllowedOrigins(List.of(
                                "http://localhost:5173", // Vite dev server
                                "http://localhost:3000", // fallback
                                "https://coderoom.vercel.app" // production later
                ));

                config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
                config.setAllowedHeaders(List.of("*"));
                config.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/api/**", config);
                return source;
        }
}