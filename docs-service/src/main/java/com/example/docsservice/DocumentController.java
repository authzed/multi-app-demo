package com.example.docsservice;

import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class DocumentController {

    private List<Document> documents = new ArrayList<>();

    public DocumentController() {
        documents.add(new Document("1", "Project Proposal", "This is a project proposal document...", "user1"));
        documents.add(new Document("2", "Meeting Notes", "Meeting notes from today's standup...", "user2"));
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "docs");
    }

    @GetMapping("/documents")
    public List<Document> getDocuments() {
        return documents;
    }

    @PostMapping("/documents")
    public Document createDocument(@RequestBody Document document) {
        document.setId(String.valueOf(System.currentTimeMillis()));
        documents.add(document);
        return document;
    }

    @GetMapping("/documents/{id}")
    public Document getDocument(@PathVariable String id) {
        return documents.stream()
                .filter(doc -> doc.getId().equals(id))
                .findFirst()
                .orElse(null);
    }
}