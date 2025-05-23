package com.example.docsservice;

public class Document {
    private String id;
    private String title;
    private String content;
    private String owner;

    public Document() {}

    public Document(String id, String title, String content, String owner) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.owner = owner;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
}