from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0009_matchplayerassignment_display_image_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='hint',
            name='is_withdrawn',
            field=models.BooleanField(default=False),
        ),
    ]
