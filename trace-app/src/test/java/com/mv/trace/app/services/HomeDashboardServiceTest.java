package com.mv.trace.app.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class HomeDashboardServiceTest {

    @Test
    void shouldBuildDashboardFromTrelloJson() throws Exception {
        HomeDashboardService service = new HomeDashboardService(new ObjectMapper());
        String json = """
                {
                  "lists": [
                    {"id": "todo", "name": "To Do", "closed": false, "pos": 1},
                    {"id": "doing", "name": "Doing", "closed": false, "pos": 2},
                    {"id": "done", "name": "Done", "closed": false, "pos": 3}
                  ],
                  "members": [
                    {"id": "juan", "fullName": "Juan Lemos", "username": "juan"}
                  ],
                  "cards": [
                    {
                      "name": "[RHP] Criar dashboard",
                      "closed": false,
                      "idList": "todo",
                      "idMembers": ["juan"],
                      "labels": [{"name": "Feature"}],
                      "dateLastActivity": "2026-05-29T10:00:00.000Z",
                      "shortUrl": "https://trello.com/c/1"
                    },
                    {
                      "name": "Card sem responsavel",
                      "closed": false,
                      "idList": "doing",
                      "idMembers": [],
                      "labels": [{"name": "Bug"}],
                      "dateLastActivity": "2026-05-29T11:00:00.000Z",
                      "shortUrl": "https://trello.com/c/2"
                    },
                    {
                      "name": "Card fechado",
                      "closed": true,
                      "idList": "done",
                      "idMembers": ["juan"],
                      "labels": [{"name": "Feature"}]
                    }
                  ]
                }
                """;

        service.importDashboard("board.json", new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));

        var dashboard = service.getDashboard();

        assertThat(dashboard.imported()).isTrue();
        assertThat(dashboard.sourceFile()).isEqualTo("board.json");
        assertThat(dashboard.cardRows()).hasSize(2);
        assertThat(dashboard.personWorkloads())
                .anySatisfy(person -> {
                    assertThat(person.name()).isEqualTo("Juan Lemos");
                    assertThat(person.todo()).isEqualTo(1);
                    assertThat(person.total()).isEqualTo(1);
                })
                .anySatisfy(person -> {
                    assertThat(person.name()).isEqualTo("Sem responsavel");
                    assertThat(person.doing()).isEqualTo(1);
                    assertThat(person.total()).isEqualTo(1);
                });
        assertThat(dashboard.cardTypeCounts())
                .extracting("name")
                .containsExactlyInAnyOrder("[RHP] Feature", "Bug");
    }
}
