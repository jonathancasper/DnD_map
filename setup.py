from setuptools import setup
import py2app
from glob import glob
import os

web_files = []
for root, dirs, files in os.walk('web'):
    for f in files:
        web_files.append(os.path.join(root, f))

setup(
    app=['dnd_map.py'],
    data_files=[
        ('web', web_files),
    ],
    options={
        'py2app': {
            'argv_emulation': False,
            'excludes': ['tkinter'],
            'includes': ['eel'],
        }
    },
)