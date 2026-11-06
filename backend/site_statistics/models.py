from django.db import models


class DailyPageTotal(models.Model):
    day = models.DateField()
    path = models.CharField(max_length=280)
    referrer = models.CharField(max_length=20, choices=[(s, s.title()) for s in (
        'direct', 'google', 'bing', 'duckduckgo', 'github', 'linkedin', 'other',
    )])
    views = models.PositiveBigIntegerField(default=0)
    seconds = models.PositiveBigIntegerField(default=0)

    class Meta:
        ordering = ['-day', '-views', 'path']
        constraints = [models.UniqueConstraint(fields=['day', 'path', 'referrer'], name='daily_page_source_total')]
        verbose_name = 'Daily page total'
        verbose_name_plural = 'Daily page totals'

    def __str__(self):
        return f'{self.day} {self.path} ({self.referrer})'
