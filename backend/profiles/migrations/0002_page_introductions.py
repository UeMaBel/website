from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('profiles', '0001_initial')]

    operations = [
        migrations.AddField(
            model_name='profile', name='contact_introduction',
            field=models.TextField(blank=True, help_text='Markdown source for the Contact page'),
        ),
        migrations.AddField(
            model_name='profile', name='projects_introduction',
            field=models.TextField(blank=True, help_text='Markdown source for the Projects overview'),
        ),
    ]
