#!/usr/bin/env python
# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.contrib.auth.models import User


def doit(opts, args):
    for arg in args:
        username = 'nasa' + arg
        numMatches = User.objects.filter(username=username).count()
        if numMatches:
            print 'skipping %s, user exists' % arg
        user = User.objects.create_user(username,
                                        '%s@example.com' % arg,
                                        opts.password)
        user.first_name = 'Phone ' + arg.upper()
        user.last_name = 'group'
        user.save()


def main():
    import optparse
    parser = optparse.OptionParser()
    parser.add_option('-p', '--password',
                      help='password to use for new accounts')
    opts, args = parser.parse_args()
    doit(opts, args)

if __name__ == '__main__':
    main()
