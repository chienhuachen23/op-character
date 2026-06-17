from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("rooms", "0007_round_assignments_snapshot"),
    ]

    operations = [
        migrations.CreateModel(
            name="CharacterRerollRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(
                    choices=[("pending", "Pending"), ("rejected", "Rejected")],
                    default="pending",
                    max_length=20,
                )),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("requester_player", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="character_reroll_requests_made",
                    to="rooms.player",
                )),
                ("round", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="character_reroll_requests",
                    to="rooms.round",
                )),
                ("target_player", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="character_reroll_targets",
                    to="rooms.player",
                )),
            ],
            options={
                "db_table": "character_reroll_requests",
                "indexes": [
                    models.Index(fields=["round", "status"], name="character_r_round_i_6f0a2a_idx"),
                ],
            },
        ),
    ]
