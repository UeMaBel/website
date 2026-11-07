from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("projects", "0002_project_thumbnail")]

    operations = [
        migrations.AddField(
            model_name="project",
            name="hide_thumbnail_on_detail",
            field=models.BooleanField(
                "Hide thumbnail on detail page", default=False,
                help_text="Keep the thumbnail in listings, but hide it on its own page and draft preview.",
            ),
        ),
    ]
