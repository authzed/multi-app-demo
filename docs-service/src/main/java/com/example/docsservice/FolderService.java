package com.example.docsservice;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.util.Optional;

@Service
public class FolderService {

    @Autowired
    private FolderRepository folderRepository;

    @PostConstruct
    public void initializeRootFolder() {
        Optional<Folder> existingRoot = folderRepository.findByIsRootTrue();
        if (existingRoot.isEmpty()) {
            Folder rootFolder = new Folder();
            rootFolder.setName("Root");
            rootFolder.setOwner("system");
            rootFolder.setIsRoot(true);
            rootFolder.getViewers().add("system");
            folderRepository.save(rootFolder);
        }
    }

    public Folder getRootFolder() {
        return folderRepository.findByIsRootTrue()
                .orElseThrow(() -> new RuntimeException("Root folder not found"));
    }
}