set datafile separator ","
set title 'Monsters'
set ylabel 'AC'
set xlabel 'Level'
set grid
plot 'monsters.csv' using 4:7