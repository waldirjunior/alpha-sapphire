import unittest

from audit_overworld_clips import motion_profile


class OverworldClipTests(unittest.TestCase):
    def test_requires_native_slots_and_exported_clips_independently(self):
        slots = [{'index': 0, 'frames': 1}, {'index': 2, 'frames': 14}]
        self.assertEqual(motion_profile(slots, ['idle', 'walk'])['status'], 'incomplete_pair')
        profile = motion_profile(slots, ['overworld_000', 'overworld_002'])
        self.assertEqual(profile['status'], 'native_pair')
        self.assertEqual(profile['standing_frames'], 1)
        self.assertEqual(profile['movement_frames'], 14)
        self.assertFalse(motion_profile([], ['overworld_000', 'overworld_002'])['native_standing'])

    def test_does_not_substitute_an_unrelated_motion_for_standing(self):
        profile = motion_profile([{'index': 93, 'frames': 36}], ['overworld_093'])
        self.assertEqual(profile['status'], 'incomplete_pair')
        self.assertFalse(profile['native_standing'])
        self.assertFalse(profile['native_movement'])


if __name__ == '__main__':
    unittest.main()
