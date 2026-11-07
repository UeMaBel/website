from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("profiles", "0005_dsgvo")]

    operations = [migrations.RemoveField(model_name="profile", name="dsgvo")]
