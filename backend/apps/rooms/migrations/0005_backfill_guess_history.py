from django.db import migrations


def backfill_guess_history(apps, schema_editor):
    Guess = apps.get_model("rooms", "Guess")
    for guess in Guess.objects.filter(guess_history__isnull=True):
        guess.guess_history = []
        guess.save(update_fields=["guess_history"])


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0004_guess_history"),
    ]

    operations = [
        migrations.RunPython(backfill_guess_history, migrations.RunPython.noop),
    ]
