# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import logging
import os
from glob import glob

from django.core.management.base import NoArgsCommand

from geocamUtil.Builder import Builder
from geocamUtil.icons import svg, rotate
from geocamUtil.Installer import Installer

class Command(NoArgsCommand):
    help = 'Prep geocamDisasterSkin app'
    
    def handle_noargs(self, **options):
        up = os.path.dirname
        appDir = up(up(up(os.path.abspath(__file__))))
        print 'appDir:', appDir
        builder = Builder()

        # render svg to png
        svgGlob = '%s/media_src/icons/*.svg' % appDir
        svgOutput = '%s/build/media/geocamDisasterSkin/icons/map/' % appDir
        logging.debug('svgIcons %s %s' % (svgGlob, svgOutput))
        for imPath in glob(svgGlob):
            svg.buildIcon(builder, imPath, outputDir=svgOutput)

        # rotate pngs
        rotGlob = '%s/build/media/geocamDisasterSkin/icons/map/*Point.png' % appDir
        rotOutput = '%s/build/media/geocamDisasterSkin/icons/mapr' % appDir
        logging.debug('rotateIcons %s %s' % (rotGlob, rotOutput))
        for imPath in glob(rotGlob):
            rotate.buildAllDirections(builder, imPath, outputDir=rotOutput)

        # link static stuff into build/media
        inst = Installer(builder)
        inst.installRecurseGlob('%s/static/*' % appDir,
                                '%s/build/media' % appDir)
