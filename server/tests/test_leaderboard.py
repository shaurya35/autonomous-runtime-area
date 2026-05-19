def test_leaderboard_empty(client):
    r = client.get("/leaderboard")
    assert r.status_code == 200
    data = r.json()
    assert "rows" in data
    assert isinstance(data["rows"], list)
    assert "incident_ids" in data
    assert "stats" in data
    stats = data["stats"]
    for key in ("solved_easy", "total_easy", "solved_medium", "total_medium", "solved_hard", "total_hard", "avg_mttr_s"):
        assert key in stats


def test_leaderboard_after_seed(client):
    client.post("/demo/seed")
    r = client.get("/leaderboard")
    assert r.status_code == 200
    data = r.json()
    assert len(data["rows"]) >= 1
    row = data["rows"][0]
    assert row["app"] == "shop-api"
    assert len(row["cells"]) >= 1
    cell = row["cells"][0]
    assert cell["incident_id"] == "SRE-0001"
    assert cell["best_score"] == 0.95
