// Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

/**
 * Campaign 4 - LZ Extraction Scenario
 * 
 * Direct continuation of Campaign 3. Features a desperate fighting retreat to LZ X-Ray, 
 * Napalm strikes, M113 ACAV encounters, and map coordinates for the visual map system.
 */
export const campaign4LZ = {
  lz_start: {
    location: "Hill 881 South, Northern Slope - 0620 Hrs",
    mapX: 45,
    mapY: 60,
    narrative: "Battalion just radioed. The perimeter on Hill 881 is collapsing under a secondary NVA assault. Your squad is ordered to fall back through the jungle to LZ X-Ray for immediate extraction. The jungle ahead is thick, and the NVA are trying to cut off your escape route.",
    choices: [
      {
        id: "lz_take_trail",
        text: "Move quickly down the main game trail to save time.",
        resolutionText: "You double-time it down the trail. It's fast, but you stumble straight into a hastily set NVA blocking position.",
        nextScene: "lz_ambush",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 15, stress: 10 }
          }
        ]
      },
      {
        id: "lz_bushwhack",
        text: "Hack your way through the dense elephant grass to avoid the trails.",
        resolutionText: "You spend an exhausting twenty minutes hacking through the razor-sharp grass. It's safe, but you're burning precious time and the heat is sweltering.",
        nextScene: "lz_clearing",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { stress: 25, supplies: -10 }
          }
        ]
      }
    ]
  },

  lz_ambush: {
    location: "Jungle Trail - 0625 Hrs",
    mapX: 40,
    mapY: 50,
    narrative: "An NVA heavy machine gun opens up from a fortified spider hole, pinning you down on the trail. You can't advance, and time is running out to catch the Huey at LZ X-Ray.",
    choices: [
      {
        id: "lz_call_napalm",
        text: "Call in a Napalm strike danger-close on the spider hole (Requires 1 Valor Point).",
        resolutionText: "You grab the radio, screaming coordinates. A flight of F-4 Phantoms screams overhead, dropping canisters of Napalm. A wall of searing heat and orange flame instantly obliterates the machine gun nest, clearing the path.",
        nextScene: "lz_clearing",
        requirements: {
          stat: "valorPoints",
          value: 1
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -20, valorPoints: -1 }
          }
        ]
      },
      {
        id: "lz_call_howitzer",
        text: "Radio Khe Sanh Combat Base for a 155mm Howitzer barrage on the treeline.",
        resolutionText: "You call in the coordinates. The heavy thump of 155mm shells echoes across the valley before raining down on the enemy positions, shredding the bamboo and suppressing the ambush.",
        nextScene: "lz_clearing",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, supplies: -20, stress: -5 }
          }
        ]
      },
      {
        id: "lz_flank_ambush",
        text: "Have Kowalski lay down suppressing fire while Jenkins flanks with grenades.",
        resolutionText: "Kowalski's M60 roars, chewing up the jungle and keeping the gunner's head down. Jenkins slips through the grass and tosses two frags into the hole, silencing the gun.",
        nextScene: "lz_clearing",
        requirements: {
          alive: "kowalski",
          alive2: "jenkins"
        },
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: 10, supplies: -15, stress: 10 }
          }
        ]
      }
    ]
  },

  lz_clearing: {
    location: "Highway 9 - 0640 Hrs",
    mapX: 30,
    mapY: 35,
    narrative: "You break out of the jungle onto the red dirt of Highway 9. A U.S. convoy has been ambushed here. An M113 ACAV is stalled on the road, its crew pinned down by snipers in the treeline. The LZ is just a klick away.",
    choices: [
      {
        id: "lz_man_50cal",
        text: "Sprint to the M113, climb on top, and man the exposed .50 caliber machine gun to suppress the treeline.",
        resolutionText: "You scramble up the aluminum side of the ACAV, grab the spade grips of the Ma Deuce, and unleash a devastating torrent of heavy fire into the treeline, shredding the snipers and saving the crew.",
        nextScene: "lz_arrival",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { valorPoints: 1, stress: -10 }
          }
        ]
      },
      {
        id: "lz_leave_acav",
        text: "Leave the convoy to their fate. We have to reach LZ X-Ray before the choppers leave.",
        resolutionText: "You avert your eyes and lead the squad into the ditch, bypassing the ambush. The sounds of the dying convoy fade behind you. It's a bitter choice, but you make good time.",
        nextScene: "lz_arrival",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { stress: 20 }
          }
        ]
      }
    ]
  },

  lz_arrival: {
    location: "LZ X-Ray - 0655 Hrs",
    mapX: 20,
    mapY: 20,
    narrative: "You burst into the elephant grass of LZ X-Ray. A UH-1 Huey is hovering inches off the ground, rotor wash flattening the grass. NVA mortars begin impacting on the edge of the LZ. The door gunner is frantically waving you in.",
    choices: [
      {
        id: "lz_board_huey",
        text: "Pop green smoke and sprint for the open doors of the Huey.",
        resolutionText: "You dive onto the aluminum floor of the chopper as it pitches violently upward, banking away from the mortar fire. As the jungle shrinks below you, you slump against the bulkhead. You made it out.",
        nextScene: "campaign_end",
        requirements: {},
        events: [
          {
            type: "STAT_CHANGED",
            payload: { heat: -50 }
          }
        ]
      }
    ]
  },

  campaign_end: {
    location: "Airborne over Khe Sanh - 0700 Hrs",
    mapX: 10,
    mapY: 10,
    narrative: "The wind rips through the open doors of the Huey. The pilot hands back a canteen. The squad is battered, bleeding, but alive. End of Campaign 4.",
    choices: []
  }
};
