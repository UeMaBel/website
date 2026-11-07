from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("blog", "0003_blogpost_thumbnail")]

    operations = [
        migrations.AddField(
            model_name="blogpost",
            name="hide_thumbnail_on_detail",
            field=models.BooleanField(
                "Hide thumbnail on detail page", default=False,
                help_text="Keep the thumbnail in listings, but hide it on its own page and draft preview.",
            ),
        ),
    ]
