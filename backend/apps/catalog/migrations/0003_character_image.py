from django.db import migrations, models
import django.db.models.deletion


def copy_legacy_images(apps, schema_editor):
    Character = apps.get_model("catalog", "Character")
    CharacterImage = apps.get_model("catalog", "CharacterImage")
    for character in Character.objects.exclude(image_url=""):
        url = (character.image_url or "").strip()
        if not url:
            continue
        CharacterImage.objects.get_or_create(
            character=character,
            image_url=url,
            defaults={"sort_order": 0},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0002_character_image_url_optional"),
    ]

    operations = [
        migrations.CreateModel(
            name="CharacterImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image_url", models.CharField(max_length=500)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "character",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="images",
                        to="catalog.character",
                    ),
                ),
            ],
            options={
                "db_table": "character_images",
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="characterimage",
            index=models.Index(fields=["character", "sort_order"], name="character_i_charact_0f0f62_idx"),
        ),
        migrations.RunPython(copy_legacy_images, migrations.RunPython.noop),
    ]
