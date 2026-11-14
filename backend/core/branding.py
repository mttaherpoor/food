"""Dynamic admin branding backed by SiteSettings."""


def _site_name() -> str:
    from core.models import SiteSettings

    name = SiteSettings.objects.filter(pk=1).values_list('site_name', flat=True).first()
    return name or 'فودسک'


def admin_site_title(request) -> str:
    return f'{_site_name()} | مدیریت'


def admin_site_header(request) -> str:
    return _site_name()


def admin_site_logo(request) -> str | None:
    from core.models import SiteSettings

    config = SiteSettings.objects.filter(pk=1).first()
    return config.logo.url if config and config.logo else None


def admin_site_icon(request) -> str | None:
    from core.models import SiteSettings

    config = SiteSettings.objects.filter(pk=1).first()
    return config.favicon.url if config and config.favicon else None


def admin_site_favicon(request) -> str:
    from django.templatetags.static import static

    from core.models import SiteSettings

    config = SiteSettings.objects.filter(pk=1).first()
    if config and config.favicon:
        return config.favicon.url

    return static('branding/icon.svg')
