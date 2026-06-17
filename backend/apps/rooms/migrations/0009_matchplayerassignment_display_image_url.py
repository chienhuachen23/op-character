from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rooms", "0008_character_reroll_request"),
    ]

    operations = [
        migrations.AddField(
            model_name="matchplayerassignment",
            name="display_image_url",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]
