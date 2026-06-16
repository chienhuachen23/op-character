import random
import string

from django.conf import settings


def generate_room_code(length=None):
    length = length or settings.ROOM_CODE_LENGTH
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))
