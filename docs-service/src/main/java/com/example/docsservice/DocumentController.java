package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@CrossOrigin(origins = "*")
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "healthy", "service", "docs");
    }

    @GetMapping("/documents")
    public List<Document> getDocuments(@RequestHeader(value = "X-Username", required = false) String username) {
        if (username != null && !username.isEmpty()) {
            return documentRepository.findByOwner(username);
        }
        return documentRepository.findAll();
    }

    @PostMapping("/documents")
    public Document createDocument(@RequestBody Document document, 
                                 @RequestHeader(value = "X-Username", required = false) String username) {
        if (username != null && !username.isEmpty()) {
            document.setOwner(username);
        }
        return documentRepository.save(document);
    }

    @GetMapping("/documents/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable Long id) {
        Optional<Document> document = documentRepository.findById(id);
        if (document.isPresent()) {
            return ResponseEntity.ok(document.get());
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/documents/{id}")
    public ResponseEntity<Document> updateDocument(@PathVariable Long id, 
                                                 @RequestBody Document updatedDocument) {
        Optional<Document> existingDocument = documentRepository.findById(id);
        if (existingDocument.isPresent()) {
            Document document = existingDocument.get();
            document.setTitle(updatedDocument.getTitle());
            document.setContent(updatedDocument.getContent());
            return ResponseEntity.ok(documentRepository.save(document));
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        if (documentRepository.existsById(id)) {
            documentRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}