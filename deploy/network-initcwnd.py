#!/usr/bin/env python3
"""Keep this static host's measured TCP startup setting across DHCP/boot."""
import subprocess


def route_command(output):
    routes = [line.split() for line in output.splitlines() if line.strip()]
    if len(routes) != 1 or routes[0][0] != 'default':
        raise ValueError('Expected one existing IPv4 default route; no route changed')
    words = routes[0]
    if not all(field in words for field in ('via', 'dev', 'src', 'metric')):
        raise ValueError('Unrecognized default route; no route changed')
    if 'initcwnd' in words:
        index = words.index('initcwnd')
        if words[index + 1] == '64':
            return None
        del words[index:index + 2]
    return ['ip', '-4', 'route', 'change', *words, 'initcwnd', '64']


def main():
    result = subprocess.run(['ip', '-4', 'route', 'show', 'default'],
                            check=True, capture_output=True, text=True)
    command = route_command(result.stdout)
    if command:
        subprocess.run(command, check=True)
        print('Applied TCP initial window 64 while retaining the existing default route')


if __name__ == '__main__':
    main()
