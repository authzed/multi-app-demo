package com.example.docsservice;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class FolderService {

    @Autowired
    private FolderRepository folderRepository;

    @PostConstruct
    private void initializeRootFolder() {
        Optional<Folder> existingRoot = folderRepository.findByIsRootTrue();
        Folder rootFolder;
        if (existingRoot.isEmpty()) {
            rootFolder = new Folder();
            rootFolder.setName("Root");
            rootFolder.setIsRoot(true);
            rootFolder = folderRepository.save(rootFolder);
        }
    }

    public Folder getRootFolder() {
        return folderRepository.findByIsRootTrue()
                .orElseThrow(() -> new RuntimeException("Root folder not found"));
    }
}