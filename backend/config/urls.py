"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from blog.views import public_blog_detail, public_blog_list, public_blog_tags
from profiles.views import public_profile
from .views import health

urlpatterns = [
    path("api/v1/health/", health, name="health"),
    path('api/v1/blog/posts/', public_blog_list, name='public-blog-list'),
    path('api/v1/blog/posts/<slug:slug>/', public_blog_detail, name='public-blog-detail'),
    path('api/v1/blog/tags/', public_blog_tags, name='public-blog-tags'),
    path('api/v1/profile/', public_profile, name='public-profile'),
    path('admin/', admin.site.urls),
]
