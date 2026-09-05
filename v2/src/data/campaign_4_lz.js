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
    weather: "Rain",
    narrative: "Battalion just radioed. The perimeter on Hill 881 is collapsing under a secondary NVA assault. The morning fog shifts into steady tropical rain as your squad falls back through the canopy toward LZ X-Ray. Static crackles over the PRC-25 on 52.00 MHz: 'Whiskey One, this is Dustoff 2-1 inbound to LZ X-Ray. ETA 15 minutes. Secure that clearing!' The jungle ahead is thick, and the NVA are maneuvering to cut off your escape route.",
    choices: [
      {
        id: "lz_take_trail",
        text: "Move quickly down the main game trail to save time.",
        resolutionText: "You double-time it down the trail through the rain. It's fast, but you stumble straight into a hastily set NVA blocking position.",
        nextScene: "lz_ambush",
        requirements: {},
        events: [
          {
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "Medevac", callsign: "Dustoff 2-1", text: "Whiskey One, Dustoff 2-1 inbound LZ X-Ray. ETA 15 minutes. Secure that clearing!", sender: "Dustoff 2-1" }
          },
          {
            type: "WEATHER_CHANGED",
            payload: { type: "Rain", name: "Rain" }
          },
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
            type: "RADIO_MESSAGE_RECEIVED",
            payload: { channel: "Medevac", callsign: "Dustoff 2-1", text: "Whiskey One, Dustoff 2-1 inbound LZ X-Ray. ETA 15 minutes. Secure that clearing!", sender: "Dustoff 2-1" }
          },
          {
            type: "WEATHER_CHANGED",
            payload: { type: "Rain", name: "Rain" }
          },
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
    narrative: "AMBUSH! A concealed NVA canopy sniper cracks a 7.62mm round through Jenkins's helmet cover, while a B-40 RPG team in a reinforced spider hole opens up, pinning you down on the muddy trail. Shrapnel strips the foliage bare. You cannot advance, and time is running out to reach LZ X-Ray.",
    choices: [
      {
        id: "lz_counter_sniper",
        text: "[SHARPSHOOTER] Pinpoint and eliminate the canopy sniper with precision marksmanship.",
        resolutionText: "Spotting the muzzle smoke through the dripping canopy, your marksman takes a steady breath and drops the sniper out of the ironwood branches with a single shot, breaking the enemy crossfire.",
        nextScene: "lz_clearing",
        requirements: {
          trait: "Sharpshooter"
        },
        events: [
          {
            type: "AMBUSH_WARNING",
            payload: { threat: "Sniper", location: "Canopy" }
          },
          {
            type: "AMBUSH_EVADED",
            payload: { threat: "Sniper" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: -15, stress: -10 }
          }
        ]
      },
      {
        id: "lz_intel_bypass",
        text: "[MEDIUM INTEL] Use captured patrol route to bypass the RPG trap along the creek bed.",
        resolutionText: "Referencing the captured sapper documents, you guide the squad into a hidden drainage gulley, completely outflanking the RPG kill zone and leaving the ambush behind.",
        nextScene: "lz_clearing",
        requirements: {
          intelTier: "MEDIUM"
        },
        events: [
          {
            type: "AMBUSH_WARNING",
            payload: { threat: "RPG", location: "Trail" }
          },
          {
            type: "AMBUSH_EVADED",
            payload: { threat: "RPG" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: -10, supplies: -5 }
          }
        ]
      },
      {
        id: "lz_call_napalm",
        text: "Call in Phantoms for tactical Napalm strike on the spider hole (Grounded in Monsoon/Thunderstorm).",
        resolutionText: "You scream target coordinates into the radio. Flight lead acknowledges and drops two napalm canisters. Searing orange flame engulfs the spider hole and clears the path.",
        nextScene: "lz_clearing",
        requirements: {
          notWeather: ["Thunderstorm", "Monsoon"]
        },
        events: [
          {
            type: "AMBUSH_TRIGGERED",
            payload: { threat: "RPG", trap: "Spider Hole" }
          },
          {
            type: "STAT_CHANGED",
            payload: { heat: -20, supplies: -15 }
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
            type: "AMBUSH_TRIGGERED",
            payload: { threat: "RPG", trap: "Spider Hole" }
          },
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
            type: "AMBUSH_TRIGGERED",
            payload: { threat: "RPG", trap: "Spider Hole" }
          },
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
    postCombat: true,
    recoveryAvailable: true,
    narrative: "You break out of the jungle onto the red dirt of Highway 9. A U.S. convoy has been ambushed here. An M113 ACAV is stalled on the road, its crew pinned down by snipers in the treeline. The firefight has subsided into tense overwatch, leaving critical battlefield recovery opportunities before you sprint for the LZ.",
    choices: [
      {
        id: "recovery_salvage_50cal",
        text: "Salvage .50 Cal Ammo & Weapons: Recover heavy ammunition and weapons (+10 Supplies, +1 Valor Point, +20 Heat).",
        resolutionText: "You scramble to the rear of the ACAV, breaking open ammo boxes to grab linked .50 caliber rounds and an undamaged M79 grenade launcher, bolstering squad firepower.",
        nextScene: "lz_arrival",
        recoveryAction: "salvage_weapons",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "lz_clearing" }
          }
        ]
      },
      {
        id: "recovery_courier_satchel",
        text: "Inspect Enemy Courier Satchel: Examine fallen NVA scout courier (+20 Intel, +10 Heat).",
        resolutionText: "You roll over a fallen NVA courier at the ditch edge, retrieving a waterproof pouch packed with regimental dispatch maps and LZ anti-air firing coordinates.",
        nextScene: "lz_arrival",
        recoveryAction: "recover_documents",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "lz_clearing" }
          }
        ]
      },
      {
        id: "recovery_rescue_crew",
        text: "Rescue Pinned Vehicle Crew: Pull wounded cavalrymen from the damaged ACAV (+10 Morale, +25 Heat).",
        resolutionText: "Under intermittent sniper fire, your squad extracts two wounded cavalry crewmen from the smoking M113 hull, bandaging their wounds and helping them limp toward the LZ.",
        nextScene: "lz_arrival",
        recoveryAction: "evacuate_fallen",
        requirements: {},
        events: [
          {
            type: "RECOVERY_OFFERED",
            payload: { context: "lz_clearing" }
          }
        ]
      },
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
    narrative: "You burst into the elephant grass of LZ X-Ray. A UH-1 Huey is hovering inches off the ground, rotor wash flattening the grass. NVA mortars and automatic fire impact along the treeline as hostile infantry closes in. The door gunner is frantically spraying suppressive fire and waving you in.",
    choices: [
      {
        id: "lz_rear_guard_sacrifice",
        text: "[REAR GUARD SACRIFICE] Have Point Man Jenkins stay at the treeline with Claymores to buy time for Huey liftoff.",
        resolutionText: "Jenkins salutes grimly, takes two Claymore clackers, and turns back toward the swarm of advancing NVA regulars. His heroic sacrifice holds the enemy back as the Huey lifts into the storm.",
        nextScene: "campaign_end",
        requirements: {
          alive: "jenkins"
        },
        events: [
          {
            type: "EXTRACTION_HEROIC_SACRIFICE",
            payload: { soldierId: "jenkins", role: "Point Man" }
          },
          {
            type: "HEROIC_ACTION",
            payload: {
              soldierId: "jenkins",
              action: "Rear Guard Sacrifice",
              medal: "Medal of Honor",
              citation: "Voluntarily stayed behind at LZ X-Ray perimeter with Claymore mines to ensure squad extraction."
            }
          }
        ]
      },
      {
        id: "lz_board_huey",
        text: "Board Huey Together: Sprint under suppressive fire from door gunners.",
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
