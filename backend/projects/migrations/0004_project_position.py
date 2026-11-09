from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('projects', '0003_project_hide_thumbnail_on_detail')]

    operations = [
        migrations.AddField(
            model_name='project',
            name='position',
            field=models.IntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name='project',
            options={'ordering': ['position', 'title', 'pk']},
        ),
    ]
