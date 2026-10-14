import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('network_setting', Path(__file__).resolve().parents[2] / 'deploy/network-initcwnd.py')
network = importlib.util.module_from_spec(spec)
spec.loader.exec_module(network)


class NetworkSettingContracts(unittest.TestCase):
    def test_preserves_existing_gateway_device_source_metric_and_other_route_options(self):
        route = 'default via 10.0.0.1 dev eth0 proto dhcp src 10.0.0.171 metric 100 mtu 1500'
        command = network.route_command(route)
        self.assertEqual(command[:4], ['ip', '-4', 'route', 'change'])
        self.assertEqual(command[4:-2], route.split())
        self.assertEqual(command[-2:], ['initcwnd', '64'])

    def test_existing_target_setting_causes_no_network_write(self):
        self.assertIsNone(network.route_command('default via 10.0.0.1 dev eth0 src 10.0.0.171 metric 100 initcwnd 64'))

    def test_replaces_only_old_window_value(self):
        route = 'default via 10.0.0.1 dev eth0 src 10.0.0.171 metric 100 initcwnd 10'
        command = network.route_command(route)
        self.assertNotIn('10', command)
        self.assertEqual(command[4:-2], route.split()[:-2])

    def test_refuses_missing_multiple_or_incomplete_routes(self):
        for route in ('', 'default dev eth0', 'default via 10.0.0.1 dev eth0 src 10.0.0.171 metric 100\ndefault via 10.0.0.2 dev eth1 src 10.0.0.171 metric 200'):
            with self.subTest(route=route), self.assertRaises(ValueError):
                network.route_command(route)
