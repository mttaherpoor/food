from config.env import get_bool
from config.settings.base import *

DEBUG = get_bool("DJANGO_DEBUG", default=True)
