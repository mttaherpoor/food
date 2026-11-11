from django.templatetags.static import static

from dataclasses import dataclass


@dataclass(frozen=True)
class ImageData:
    url: str
    alt: str


class CatalogImageMixin:
    DEFAULT_IMAGE = "images/defaults/default-food.webp"

    @property
    def image_data(self) -> ImageData:
        image = getattr(self, "image", None)

        if image:
            return ImageData(
                url=image.url,
                alt=str(self),
            )

        return ImageData(
            url=static(self.DEFAULT_IMAGE),
            alt=str(self),
        )
