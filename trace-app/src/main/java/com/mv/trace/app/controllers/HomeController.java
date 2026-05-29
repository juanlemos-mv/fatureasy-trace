package com.mv.trace.app.controllers;

import com.mv.trace.app.services.HomeDashboardService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;

@Controller
public class HomeController {

    private final HomeDashboardService homeDashboardService;

    public HomeController(HomeDashboardService homeDashboardService) {
        this.homeDashboardService = homeDashboardService;
    }

    @GetMapping("/")
    public String index(Model model) {
        model.addAttribute("dashboard", homeDashboardService.getDashboard());
        return "home/index";
    }

    @PostMapping("/dashboard/import")
    public String importDashboard(@RequestParam("file") MultipartFile file, RedirectAttributes redirectAttributes) {
        if (file.isEmpty()) {
            redirectAttributes.addFlashAttribute("importError", "Selecione um arquivo JSON do Trello.");
            return "redirect:/";
        }

        try {
            homeDashboardService.importDashboard(file.getOriginalFilename(), file.getInputStream());
            redirectAttributes.addFlashAttribute("importMessage", "JSON importado com sucesso.");
        } catch (IOException | IllegalArgumentException exception) {
            redirectAttributes.addFlashAttribute("importError", "Nao foi possivel importar o JSON informado.");
        }

        return "redirect:/";
    }
}
